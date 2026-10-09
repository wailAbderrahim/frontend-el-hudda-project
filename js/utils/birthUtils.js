/**
 * Utilities for parsing, sanitizing, and formatting birth information
 * Handles separation between date of birth and place/municipality of birth.
 */

// Matches various date strings that users might have entered:
// - YYYY-MM-DD or YYYY/MM/DD
// - DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
// - 8 digits like DDMMYYYY (e.g. 22012003)
const DATE_PATTERN = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{8})$/;

/**
 * Parses and sanitizes a user's birth data.
 * If placeOfBirth contains a date, extracts it as dateOfBirth and falls back to municipality.
 *
 * @param {Object} user User or student object
 * @returns {{ dateOfBirth: string|null, placeOfBirth: string, municipalityOfBirth: string }}
 */
export function parseBirthInfo(user) {
    if (!user || typeof user !== "object") {
        return {
            dateOfBirth: null,
            placeOfBirth: "—",
            municipalityOfBirth: "—"
        };
    }

    let dateOfBirth = (user.dateOfBirth || "").toString().trim() || null;
    let placeOfBirth = (user.placeOfBirth || "").toString().trim();
    let municipalityOfBirth = (user.municipalityOfBirth || "").toString().trim();

    // Check if placeOfBirth mistakenly contains a date format
    if (placeOfBirth && DATE_PATTERN.test(placeOfBirth)) {
        if (!dateOfBirth) {
            dateOfBirth = placeOfBirth;
        }
        // Place of birth should NEVER be a date. Fallback to municipality if valid, otherwise empty
        placeOfBirth = (!DATE_PATTERN.test(municipalityOfBirth) && municipalityOfBirth) ? municipalityOfBirth : "";
    }

    // Check if municipalityOfBirth mistakenly contains a date format
    if (municipalityOfBirth && DATE_PATTERN.test(municipalityOfBirth)) {
        if (!dateOfBirth) {
            dateOfBirth = municipalityOfBirth;
        }
        municipalityOfBirth = "";
    }

    return {
        dateOfBirth,
        placeOfBirth: placeOfBirth || "—",
        municipalityOfBirth: municipalityOfBirth || "—"
    };
}

/**
 * Formats a birth date string into a clean Arabic date or readable string.
 * Supports ISO, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, and DDMMYYYY.
 *
 * @param {string|Date|null} dateVal
 * @returns {string} Formatted date or "—"
 */
export function formatBirthDate(dateVal) {
    if (!dateVal || dateVal === "—") return "—";

    const str = dateVal.toString().trim();
    if (!str) return "—";

    let dateObj = null;

    // Format DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        dateObj = new Date(Number(year), Number(month) - 1, Number(day));
    }

    // Format YYYY-MM-DD or YYYY/MM/DD
    if (!dateObj) {
        const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (ymdMatch) {
            const [, year, month, day] = ymdMatch;
            dateObj = new Date(Number(year), Number(month) - 1, Number(day));
        }
    }

    // Format DDMMYYYY (8 consecutive digits)
    if (!dateObj) {
        const d8Match = str.match(/^(\d{2})(\d{2})(\d{4})$/);
        if (d8Match) {
            const [, day, month, year] = d8Match;
            dateObj = new Date(Number(year), Number(month) - 1, Number(day));
        }
    }

    // Standard Date fallback
    if (!dateObj) {
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) {
            dateObj = parsed;
        }
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
        try {
            return dateObj.toLocaleDateString("ar-EG", {
                year: "numeric",
                month: "long",
                day: "numeric"
            });
        } catch (_) {
            return dateObj.toLocaleDateString();
        }
    }

    return str;
}

/**
 * Combines place of birth and municipality into a deduplicated display string.
 *
 * @param {Object} user
 * @returns {string} Combined place string (e.g., "باتنة" or "باتنة - عيون العصافير")
 */
export function formatBirthPlaces(user) {
    const { placeOfBirth, municipalityOfBirth } = parseBirthInfo(user);
    const parts = [placeOfBirth, municipalityOfBirth].filter(
        (p) => p && p !== "—" && !DATE_PATTERN.test(p)
    );

    const unique = [...new Set(parts)];
    return unique.length > 0 ? unique.join(" - ") : "—";
}
