import { NAME_REGEX } from './constants';

describe('NAME_REGEX', () => {
    it('should allow alphanumeric lower and uppercase', () => {
        expect(NAME_REGEX.test('ThisIsAlphanumeric123')).toBeTruthy();
    });
    it('should allow acutes', () => {
        expect(NAME_REGEX.test('éèîôàùêïöÀÈÉÎÔÙÊÏÖÜ')).toBeTruthy();
    });
    it(`should allow / @ ( ) ' - _ , . space`, () => {
        expect(NAME_REGEX.test(`/ @ ( ) ' - _ , . `)).toBeTruthy();
    });
    it(`should allow non latin characters`, () => {
        expect(NAME_REGEX.test(`abæcdöef`)).toBeTruthy();
        expect(NAME_REGEX.test(`правда`)).toBeTruthy();
        expect(NAME_REGEX.test(`ยจฆฟคฏข`)).toBeTruthy();
        expect(NAME_REGEX.test(`도메인`)).toBeTruthy();
        expect(NAME_REGEX.test(`ドメイン名例`)).toBeTruthy();
        expect(NAME_REGEX.test(`MajiでKoiする5秒前`)).toBeTruthy();
        expect(NAME_REGEX.test(`Krstanović Bezsažna Kołodziejczak Štepec`)).toBeTruthy();
        expect(NAME_REGEX.test(`הדר כהן`)).toBeTruthy();
        expect(NAME_REGEX.test(`Đỗ Ngọc Tuấn`)).toBeTruthy();
        expect(NAME_REGEX.test(`HALİL İBRAHİM`)).toBeTruthy();
        expect(NAME_REGEX.test(`博 林 석주 박 益颖 麦 宇鴻 台師大 藍`)).toBeTruthy();
    });
    it(`should not allow ; : { } ^ ! " # $ % & * + < = > ? [ ] \\ | ~`, () => {
        expect(NAME_REGEX.test('a;a')).toBeFalsy();
        expect(NAME_REGEX.test('a:a')).toBeFalsy();
        expect(NAME_REGEX.test('a{a')).toBeFalsy();
        expect(NAME_REGEX.test('a}a')).toBeFalsy();
        expect(NAME_REGEX.test('a^a')).toBeFalsy();
        expect(NAME_REGEX.test('a!a')).toBeFalsy();
        expect(NAME_REGEX.test('a"a')).toBeFalsy();
        expect(NAME_REGEX.test('a#a')).toBeFalsy();
        expect(NAME_REGEX.test('a$a')).toBeFalsy();
        expect(NAME_REGEX.test('a%a')).toBeFalsy();
        expect(NAME_REGEX.test('a&a')).toBeFalsy();
        expect(NAME_REGEX.test('a*a')).toBeFalsy();
        expect(NAME_REGEX.test('a+a')).toBeFalsy();
        expect(NAME_REGEX.test('a<a')).toBeFalsy();
        expect(NAME_REGEX.test('a=a')).toBeFalsy();
        expect(NAME_REGEX.test('a>a')).toBeFalsy();
        expect(NAME_REGEX.test('a?a')).toBeFalsy();
        expect(NAME_REGEX.test('a[a')).toBeFalsy();
        expect(NAME_REGEX.test('a]a')).toBeFalsy();
        expect(NAME_REGEX.test('a\\a')).toBeFalsy();
        expect(NAME_REGEX.test('a~a')).toBeFalsy();
    });
});
