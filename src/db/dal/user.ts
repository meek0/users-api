import { S3 } from '@aws-sdk/client-s3';
import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import { Op, Order } from 'sequelize';
import { uuid } from 'uuidv4';

import { profileImageBucket } from '../../config/env';
import config from '../../config/project';
import { UserValidator } from '../../utils/userValidator';
import UserModel, { IUserInput, IUserOuput } from '../models/User';

let S3Client;
try {
    S3Client = new S3({});
} catch (error) {
    console.warn('S3 client not initialized');
}

const sanitizeInputPayload = (payload: IUserInput) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, keycloak_id, completed_registration, creation_date, ...rest } = payload;
    return rest;
};

const createMatchClauses = (match: string) => {
    if (!match) return {};
    const matchLikeClause = { [Op.iLike]: `%${match}%` };
    return {
        [Op.or]: [{ first_name: matchLikeClause }, { last_name: matchLikeClause }, { affiliation: matchLikeClause }],
    };
};

const createAndClauses = (
    filters: {
        filterName: string;
        filterArray: string[];
        filterOptions: string[];
    }[],
) => {
    const andClauses = [];
    for (const filter of filters) {
        const filterWithoutOther = filter.filterArray.filter((item) => item.toLowerCase() !== config.otherKey);
        if (filterWithoutOther.length) {
            andClauses.push({
                [filter.filterName]: {
                    [Op.contains]: filterWithoutOther.filter((item) => item).map((item) => item.toLowerCase()),
                },
            });
        }
        if (filter.filterArray.includes(config.otherKey)) {
            andClauses.push({
                [Op.not]: { [filter.filterName]: { [Op.contained]: filter.filterOptions } },
            });
        }
    }
    return andClauses;
};

export const searchUsers = async ({
    pageSize,
    pageIndex,
    sorts,
    match,
    roles,
    dataUses,
    researchDomains,
    roleOptions,
    usageOptions,
    researchDomainsOptions,
}: {
    pageSize: number;
    pageIndex: number;
    sorts: Order;
    match: string;
    roles: string[];
    dataUses: string[];
    researchDomains: string[];
    roleOptions: string[];
    usageOptions: string[];
    researchDomainsOptions: string[];
}) => {
    const matchClauses = createMatchClauses(match);
    const filters = [
        { filterArray: roles, filterName: 'roles', filterOptions: roleOptions },
        { filterArray: dataUses, filterName: 'portal_usages', filterOptions: usageOptions },
        { filterArray: researchDomains, filterName: 'research_domains', filterOptions: researchDomainsOptions },
    ];
    const andClauses = createAndClauses(filters);

    const results = await UserModel.findAndCountAll({
        attributes: config.cleanedUserAttributes,
        limit: pageSize,
        offset: pageIndex * pageSize,
        order: sorts,
        where: {
            [Op.and]: {
                completed_registration: true,
                deleted: false,
                ...matchClauses,
                [Op.and]: andClauses,
            },
        },
    });

    return {
        users: results.rows,
        total: results.count,
    };
};

export const getProfileImageUploadPresignedUrl = async (keycloak_id: string) => {
    if (!S3Client) {
        return {
            s3Key: undefined,
            presignUrl: undefined,
        };
    }

    const s3Key = `${keycloak_id}.${config.profileImageExtension}`;
    const presignUrl = S3Client.getSignedUrl('putObject', {
        Bucket: profileImageBucket,
        Key: s3Key,
        Expires: 60 * 5,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
    });

    return {
        s3Key,
        presignUrl,
    };
};

export const getUserById = async (keycloak_id: string, isOwn: boolean): Promise<IUserOuput> => {
    let attributesClause = {};
    if (!isOwn) {
        attributesClause = {
            attributes: config.cleanedUserAttributes,
        };
    }

    const user = await UserModel.findOne({
        ...attributesClause,
        where: {
            keycloak_id,
            deleted: false,
        },
    });

    if (!user) {
        throw createHttpError(StatusCodes.NOT_FOUND, `User with keycloak id ${keycloak_id} does not exist.`);
    }

    return user;
};

export const isUserExists = async (
    keycloak_id: string,
): Promise<{
    exists: boolean;
}> => {
    const user = await UserModel.findOne({
        where: {
            keycloak_id,
        },
    });

    return {
        exists: !!user && (user?.completed_registration || false),
    };
};

export const createUser = async (keycloak_id: string, payload: IUserInput): Promise<IUserOuput> => {
    const newUser = await UserModel.create({
        ...payload,
        keycloak_id: keycloak_id,
        creation_date: new Date(),
        updated_date: new Date(),
    });
    return newUser;
};

export const updateUser = async (keycloak_id: string, payload: IUserInput): Promise<IUserOuput> => {
    const results = await UserModel.update(
        {
            ...sanitizeInputPayload(payload),
            updated_date: new Date(),
        },
        {
            where: {
                keycloak_id,
            },
            returning: true,
        },
    );

    return results[1][0];
};

export const deleteUser = async (keycloak_id: string): Promise<void> => {
    await UserModel.update(
        {
            keycloak_id: uuid(),
            email: uuid(),
            affiliation: uuid(),
            public_email: uuid(),
            nih_ned_id: uuid(),
            era_commons_id: uuid(),
            first_name: uuid(),
            last_name: uuid(),
            linkedin: uuid(),
            external_individual_fullname: uuid(),
            external_individual_email: uuid(),
            deleted: true,
        },
        {
            where: {
                keycloak_id,
            },
        },
    );
};

export const completeRegistration = async (
    keycloak_id: string,
    payload: IUserInput,
    validator: UserValidator,
): Promise<IUserOuput> => {
    if (!validator(payload)) {
        throw createHttpError(
            StatusCodes.BAD_REQUEST,
            'Some required fields are missing to complete user registration',
        );
    }

    const results = await UserModel.update(
        {
            ...sanitizeInputPayload(payload),
            completed_registration: true,
            updated_date: new Date(),
        },
        {
            where: {
                keycloak_id,
            },
            returning: true,
        },
    );

    return results[1][0];
};

export const updateRolesAndDataUsages = async (): Promise<void> => {
    const results = await UserModel.findAll();

    results.map(async (user) => {
        await UserModel.update(
            {
                ...user,
                updated_date: new Date(),
                roles: replaceRoles(user.roles || []),
                portal_usages: replacePortalUsages(user.portal_usages || []),
            },
            {
                where: {
                    keycloak_id: user.keycloak_id,
                },
                returning: true,
            },
        );
    });
};

const replaceRoles = (roles: string[]): string[] =>
    roles.map((role) => {
        switch (role.toLocaleLowerCase()) {
            case 'researcher at an academic or not-for-profit institution':
                return 'researcher';
            case 'representative from a for-profit or commercial entity':
                return 'representative';
            case 'tool or algorithm developer':
                return 'developer';
            case 'community member':
                return 'community_member';
            case 'federal employee':
                return 'federal_employee';
            default:
                return role;
        }
    });

const replacePortalUsages = (usages: string[]): string[] =>
    usages.map((usage) => {
        switch (usage.toLocaleLowerCase()) {
            case 'learning more about down syndrome and its health outcomes, management, and/or treatment':
            case 'learn more about down syndrome and its health outcomes, management, and/or treatment':
                return 'learn_more_about_down_syndrome';
            case 'helping me design a new research study':
            case 'help me design a new research study':
                return 'help_design_new_research_study';
            case 'identifying datasets that i want to analyze':
            case 'identify datasets that i want to analyze':
                return 'identifying_dataset';
            case 'commercial purposes':
                return 'commercial_purpose';
            default:
                return usage;
        }
    });
