export interface Country {
  name: string;
  code: string;       // International calling code with '+' e.g. "+1", "+91"
  iso: string;        // ISO 3166-1 alpha-2 e.g. "US", "IN"
  flag: string;       // Emoji flag
  placeholder: string;// Representative placeholder for national format
  minLength: number;  // Minimum national number digits (excluding calling code)
  maxLength: number;  // Maximum national number digits (excluding calling code)
}

export const COUNTRIES: Country[] = [
  // Frequently used & major regions
  { name: 'India', code: '+91', iso: 'IN', flag: '🇮🇳', placeholder: '98765 43210', minLength: 10, maxLength: 10 },
  { name: 'United States', code: '+1', iso: 'US', flag: '🇺🇸', placeholder: '(555) 019-2834', minLength: 10, maxLength: 10 },
  { name: 'United Kingdom', code: '+44', iso: 'GB', flag: '🇬🇧', placeholder: '7911 123456', minLength: 10, maxLength: 10 },
  { name: 'United Arab Emirates', code: '+971', iso: 'AE', flag: '🇦🇪', placeholder: '50 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Australia', code: '+61', iso: 'AU', flag: '🇦🇺', placeholder: '412 345 678', minLength: 9, maxLength: 9 },
  { name: 'Canada', code: '+1', iso: 'CA', flag: '🇨🇦', placeholder: '(555) 019-9922', minLength: 10, maxLength: 10 },
  { name: 'Germany', code: '+49', iso: 'DE', flag: '🇩🇪', placeholder: '151 23456789', minLength: 10, maxLength: 11 },
  { name: 'France', code: '+33', iso: 'FR', flag: '🇫🇷', placeholder: '6 12 34 56 78', minLength: 9, maxLength: 9 },
  { name: 'Japan', code: '+81', iso: 'JP', flag: '🇯🇵', placeholder: '90 1234 5678', minLength: 10, maxLength: 10 },
  { name: 'Saudi Arabia', code: '+966', iso: 'SA', flag: '🇸🇦', placeholder: '50 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Singapore', code: '+65', iso: 'SG', flag: '🇸🇬', placeholder: '8123 4567', minLength: 8, maxLength: 8 },
  { name: 'Brazil', code: '+55', iso: 'BR', flag: '🇧🇷', placeholder: '11 98765-4321', minLength: 10, maxLength: 11 },
  { name: 'Nigeria', code: '+234', iso: 'NG', flag: '🇳🇬', placeholder: '802 123 4567', minLength: 10, maxLength: 10 },
  { name: 'South Africa', code: '+27', iso: 'ZA', flag: '🇿🇦', placeholder: '71 123 4567', minLength: 9, maxLength: 9 },

  // A-Z Complete International List
  { name: 'Afghanistan', code: '+93', iso: 'AF', flag: '🇦🇫', placeholder: '70 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Albania', code: '+355', iso: 'AL', flag: '🇦🇱', placeholder: '67 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Algeria', code: '+213', iso: 'DZ', flag: '🇩🇿', placeholder: '551 23 45 67', minLength: 9, maxLength: 9 },
  { name: 'Andorra', code: '+376', iso: 'AD', flag: '🇦🇩', placeholder: '312 345', minLength: 6, maxLength: 6 },
  { name: 'Angola', code: '+244', iso: 'AO', flag: '🇦🇴', placeholder: '923 123 456', minLength: 9, maxLength: 9 },
  { name: 'Argentina', code: '+54', iso: 'AR', flag: '🇦🇷', placeholder: '11 1234-5678', minLength: 10, maxLength: 10 },
  { name: 'Armenia', code: '+374', iso: 'AM', flag: '🇦🇲', placeholder: '77 123456', minLength: 8, maxLength: 8 },
  { name: 'Austria', code: '+43', iso: 'AT', flag: '🇦🇹', placeholder: '664 1234567', minLength: 10, maxLength: 11 },
  { name: 'Azerbaijan', code: '+994', iso: 'AZ', flag: '🇦🇿', placeholder: '50 123 45 67', minLength: 9, maxLength: 9 },
  { name: 'Bahamas', code: '+1', iso: 'BS', flag: '🇧🇸', placeholder: '(242) 359-1234', minLength: 10, maxLength: 10 },
  { name: 'Bahrain', code: '+973', iso: 'BH', flag: '🇧🇭', placeholder: '3600 1234', minLength: 8, maxLength: 8 },
  { name: 'Bangladesh', code: '+880', iso: 'BD', flag: '🇧🇩', placeholder: '1712-345678', minLength: 10, maxLength: 10 },
  { name: 'Barbados', code: '+1', iso: 'BB', flag: '🇧🇧', placeholder: '(246) 260-1234', minLength: 10, maxLength: 10 },
  { name: 'Belarus', code: '+375', iso: 'BY', flag: '🇧🇾', placeholder: '29 123-45-67', minLength: 9, maxLength: 9 },
  { name: 'Belgium', code: '+32', iso: 'BE', flag: '🇧🇪', placeholder: '470 12 34 56', minLength: 9, maxLength: 9 },
  { name: 'Belize', code: '+501', iso: 'BZ', flag: '🇧🇿', placeholder: '622-1234', minLength: 7, maxLength: 7 },
  { name: 'Benin', code: '+229', iso: 'BJ', flag: '🇧🇯', placeholder: '97 12 34 56', minLength: 8, maxLength: 8 },
  { name: 'Bermuda', code: '+1', iso: 'BM', flag: '🇧🇲', placeholder: '(441) 599-1234', minLength: 10, maxLength: 10 },
  { name: 'Bhutan', code: '+975', iso: 'BT', flag: '🇧🇹', placeholder: '17 12 34 56', minLength: 8, maxLength: 8 },
  { name: 'Bolivia', code: '+591', iso: 'BO', flag: '🇧🇴', placeholder: '71234567', minLength: 8, maxLength: 8 },
  { name: 'Bosnia and Herzegovina', code: '+387', iso: 'BA', flag: '🇧🇦', placeholder: '61 123 456', minLength: 8, maxLength: 8 },
  { name: 'Botswana', code: '+267', iso: 'BW', flag: '🇧🇼', placeholder: '71 123 456', minLength: 8, maxLength: 8 },
  { name: 'Brunei', code: '+673', iso: 'BN', flag: '🇧🇳', placeholder: '712 3456', minLength: 7, maxLength: 7 },
  { name: 'Bulgaria', code: '+359', iso: 'BG', flag: '🇧🇬', placeholder: '87 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Burkina Faso', code: '+226', iso: 'BF', flag: '🇧🇫', placeholder: '70 12 34 56', minLength: 8, maxLength: 8 },
  { name: 'Cambodia', code: '+855', iso: 'KH', flag: '🇰🇭', placeholder: '12 345 678', minLength: 8, maxLength: 9 },
  { name: 'Cameroon', code: '+237', iso: 'CM', flag: '🇨🇲', placeholder: '6 71 23 45 67', minLength: 9, maxLength: 9 },
  { name: 'Cayman Islands', code: '+1', iso: 'KY', flag: '🇰🇾', placeholder: '(345) 925-1234', minLength: 10, maxLength: 10 },
  { name: 'Chile', code: '+56', iso: 'CL', flag: '🇨🇱', placeholder: '9 1234 5678', minLength: 9, maxLength: 9 },
  { name: 'China', code: '+86', iso: 'CN', flag: '🇨🇳', placeholder: '138 0013 8000', minLength: 11, maxLength: 11 },
  { name: 'Colombia', code: '+57', iso: 'CO', flag: '🇨🇴', placeholder: '310 1234567', minLength: 10, maxLength: 10 },
  { name: 'Costa Rica', code: '+506', iso: 'CR', flag: '🇨🇷', placeholder: '8312 3456', minLength: 8, maxLength: 8 },
  { name: 'Croatia', code: '+385', iso: 'HR', flag: '🇭🇷', placeholder: '91 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Cyprus', code: '+357', iso: 'CY', flag: '🇨🇾', placeholder: '96 123456', minLength: 8, maxLength: 8 },
  { name: 'Czech Republic', code: '+420', iso: 'CZ', flag: '🇨🇿', placeholder: '601 123 456', minLength: 9, maxLength: 9 },
  { name: 'Denmark', code: '+45', iso: 'DK', flag: '🇩🇰', placeholder: '20 12 34 56', minLength: 8, maxLength: 8 },
  { name: 'Dominican Republic', code: '+1', iso: 'DO', flag: '🇩🇴', placeholder: '(809) 234-5678', minLength: 10, maxLength: 10 },
  { name: 'Ecuador', code: '+593', iso: 'EC', flag: '🇪🇨', placeholder: '99 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Egypt', code: '+20', iso: 'EG', flag: '🇪🇬', placeholder: '100 123 4567', minLength: 10, maxLength: 10 },
  { name: 'El Salvador', code: '+503', iso: 'SV', flag: '🇸🇻', placeholder: '7012 3456', minLength: 8, maxLength: 8 },
  { name: 'Estonia', code: '+372', iso: 'EE', flag: '🇪🇪', placeholder: '5123 4567', minLength: 7, maxLength: 8 },
  { name: 'Ethiopia', code: '+251', iso: 'ET', flag: '🇪🇹', placeholder: '91 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Fiji', code: '+679', iso: 'FJ', flag: '🇫🇯', placeholder: '701 2345', minLength: 7, maxLength: 7 },
  { name: 'Finland', code: '+358', iso: 'FI', flag: '🇫🇮', placeholder: '41 2345678', minLength: 9, maxLength: 10 },
  { name: 'Georgia', code: '+995', iso: 'GE', flag: '🇬🇪', placeholder: '591 23 45 67', minLength: 9, maxLength: 9 },
  { name: 'Ghana', code: '+233', iso: 'GH', flag: '🇬🇭', placeholder: '23 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Greece', code: '+30', iso: 'GR', flag: '🇬🇷', placeholder: '691 234 5678', minLength: 10, maxLength: 10 },
  { name: 'Guatemala', code: '+502', iso: 'GT', flag: '🇬🇹', placeholder: '5123 4567', minLength: 8, maxLength: 8 },
  { name: 'Honduras', code: '+504', iso: 'HN', flag: '🇭🇳', placeholder: '9123 4567', minLength: 8, maxLength: 8 },
  { name: 'Hong Kong', code: '+852', iso: 'HK', flag: '🇭🇰', placeholder: '9123 4567', minLength: 8, maxLength: 8 },
  { name: 'Hungary', code: '+36', iso: 'HU', flag: '🇭🇺', placeholder: '20 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Iceland', code: '+354', iso: 'IS', flag: '🇮🇸', placeholder: '612 3456', minLength: 7, maxLength: 7 },
  { name: 'Indonesia', code: '+62', iso: 'ID', flag: '🇮🇩', placeholder: '812-3456-7890', minLength: 9, maxLength: 12 },
  { name: 'Iraq', code: '+964', iso: 'IQ', flag: '🇮🇶', placeholder: '790 123 4567', minLength: 10, maxLength: 10 },
  { name: 'Ireland', code: '+353', iso: 'IE', flag: '🇮🇪', placeholder: '85 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Israel', code: '+972', iso: 'IL', flag: '🇮🇱', placeholder: '50-123-4567', minLength: 9, maxLength: 9 },
  { name: 'Italy', code: '+39', iso: 'IT', flag: '🇮🇹', placeholder: '312 345 6789', minLength: 9, maxLength: 10 },
  { name: 'Jamaica', code: '+1', iso: 'JM', flag: '🇯🇲', placeholder: '(876) 312-3456', minLength: 10, maxLength: 10 },
  { name: 'Jordan', code: '+962', iso: 'JO', flag: '🇯🇴', placeholder: '7 9012 3456', minLength: 9, maxLength: 9 },
  { name: 'Kazakhstan', code: '+7', iso: 'KZ', flag: '🇰🇿', placeholder: '701 123 4567', minLength: 10, maxLength: 10 },
  { name: 'Kenya', code: '+254', iso: 'KE', flag: '🇰🇪', placeholder: '712 345678', minLength: 9, maxLength: 9 },
  { name: 'Kuwait', code: '+965', iso: 'KW', flag: '🇰🇼', placeholder: '9123 4567', minLength: 8, maxLength: 8 },
  { name: 'Latvia', code: '+371', iso: 'LV', flag: '🇱🇻', placeholder: '21 234 567', minLength: 8, maxLength: 8 },
  { name: 'Lebanon', code: '+961', iso: 'LB', flag: '🇱🇧', placeholder: '71 123 456', minLength: 8, maxLength: 8 },
  { name: 'Lithuania', code: '+370', iso: 'LT', flag: '🇱🇹', placeholder: '612 34567', minLength: 8, maxLength: 8 },
  { name: 'Luxembourg', code: '+352', iso: 'LU', flag: '🇱🇺', placeholder: '621 123 456', minLength: 9, maxLength: 9 },
  { name: 'Malaysia', code: '+60', iso: 'MY', flag: '🇲🇾', placeholder: '12-345 6789', minLength: 9, maxLength: 10 },
  { name: 'Maldives', code: '+960', iso: 'MV', flag: '🇲🇻', placeholder: '712-3456', minLength: 7, maxLength: 7 },
  { name: 'Malta', code: '+356', iso: 'MT', flag: '🇲🇹', placeholder: '9912 3456', minLength: 8, maxLength: 8 },
  { name: 'Mauritius', code: '+230', iso: 'MU', flag: '🇲🇺', placeholder: '5251 2345', minLength: 8, maxLength: 8 },
  { name: 'Mexico', code: '+52', iso: 'MX', flag: '🇲🇽', placeholder: '55 1234 5678', minLength: 10, maxLength: 10 },
  { name: 'Moldova', code: '+373', iso: 'MD', flag: '🇲🇩', placeholder: '621 12 345', minLength: 8, maxLength: 8 },
  { name: 'Monaco', code: '+377', iso: 'MC', flag: '🇲🇨', placeholder: '6 12 34 56 78', minLength: 8, maxLength: 9 },
  { name: 'Montenegro', code: '+382', iso: 'ME', flag: '🇲🇪', placeholder: '67 123 456', minLength: 8, maxLength: 8 },
  { name: 'Morocco', code: '+212', iso: 'MA', flag: '🇲🇦', placeholder: '650-123456', minLength: 9, maxLength: 9 },
  { name: 'Nepal', code: '+977', iso: 'NP', flag: '🇳🇵', placeholder: '984-1234567', minLength: 10, maxLength: 10 },
  { name: 'Netherlands', code: '+31', iso: 'NL', flag: '🇳🇱', placeholder: '6 12345678', minLength: 9, maxLength: 9 },
  { name: 'New Zealand', code: '+64', iso: 'NZ', flag: '🇳🇿', placeholder: '21 123 4567', minLength: 8, maxLength: 10 },
  { name: 'Nicaragua', code: '+505', iso: 'NI', flag: '🇳🇮', placeholder: '8123 4567', minLength: 8, maxLength: 8 },
  { name: 'Norway', code: '+47', iso: 'NO', flag: '🇳🇴', placeholder: '412 34 567', minLength: 8, maxLength: 8 },
  { name: 'Oman', code: '+968', iso: 'OM', flag: '🇴🇲', placeholder: '9123 4567', minLength: 8, maxLength: 8 },
  { name: 'Pakistan', code: '+92', iso: 'PK', flag: '🇵🇰', placeholder: '301 2345678', minLength: 10, maxLength: 10 },
  { name: 'Panama', code: '+507', iso: 'PA', flag: '🇵🇦', placeholder: '6123-4567', minLength: 8, maxLength: 8 },
  { name: 'Paraguay', code: '+595', iso: 'PY', flag: '🇵🇾', placeholder: '981 123456', minLength: 9, maxLength: 9 },
  { name: 'Peru', code: '+51', iso: 'PE', flag: '🇵🇪', placeholder: '912 345 678', minLength: 9, maxLength: 9 },
  { name: 'Philippines', code: '+63', iso: 'PH', flag: '🇵🇭', placeholder: '917 123 4567', minLength: 10, maxLength: 10 },
  { name: 'Poland', code: '+48', iso: 'PL', flag: '🇵🇱', placeholder: '512 345 678', minLength: 9, maxLength: 9 },
  { name: 'Portugal', code: '+351', iso: 'PT', flag: '🇵🇹', placeholder: '912 345 678', minLength: 9, maxLength: 9 },
  { name: 'Qatar', code: '+974', iso: 'QA', flag: '🇶🇦', placeholder: '3312 3456', minLength: 8, maxLength: 8 },
  { name: 'Romania', code: '+40', iso: 'RO', flag: '🇷🇴', placeholder: '712 345 678', minLength: 9, maxLength: 9 },
  { name: 'Russia', code: '+7', iso: 'RU', flag: '🇷🇺', placeholder: '912 345-67-89', minLength: 10, maxLength: 10 },
  { name: 'Rwanda', code: '+250', iso: 'RW', flag: '🇷🇼', placeholder: '788 123 456', minLength: 9, maxLength: 9 },
  { name: 'Senegal', code: '+221', iso: 'SN', flag: '🇸🇳', placeholder: '77 123 45 67', minLength: 9, maxLength: 9 },
  { name: 'Serbia', code: '+381', iso: 'RS', flag: '🇷🇸', placeholder: '60 1234567', minLength: 8, maxLength: 9 },
  { name: 'Slovakia', code: '+421', iso: 'SK', flag: '🇸🇰', placeholder: '912 345 678', minLength: 9, maxLength: 9 },
  { name: 'Slovenia', code: '+386', iso: 'SI', flag: '🇸🇮', placeholder: '31 234 567', minLength: 8, maxLength: 8 },
  { name: 'South Korea', code: '+82', iso: 'KR', flag: '🇰🇷', placeholder: '10-1234-5678', minLength: 9, maxLength: 10 },
  { name: 'Spain', code: '+34', iso: 'ES', flag: '🇪🇸', placeholder: '612 34 56 78', minLength: 9, maxLength: 9 },
  { name: 'Sri Lanka', code: '+94', iso: 'LK', flag: '🇱🇰', placeholder: '71 234 5678', minLength: 9, maxLength: 9 },
  { name: 'Sweden', code: '+46', iso: 'SE', flag: '🇸🇪', placeholder: '70 123 45 67', minLength: 9, maxLength: 9 },
  { name: 'Switzerland', code: '+41', iso: 'CH', flag: '🇨🇭', placeholder: '78 123 45 67', minLength: 9, maxLength: 9 },
  { name: 'Taiwan', code: '+886', iso: 'TW', flag: '🇹🇼', placeholder: '912 345 678', minLength: 9, maxLength: 9 },
  { name: 'Tanzania', code: '+255', iso: 'TZ', flag: '🇹🇿', placeholder: '712 345 678', minLength: 9, maxLength: 9 },
  { name: 'Thailand', code: '+66', iso: 'TH', flag: '🇹🇭', placeholder: '81 234 5678', minLength: 9, maxLength: 9 },
  { name: 'Trinidad and Tobago', code: '+1', iso: 'TT', flag: '🇹🇹', placeholder: '(868) 291-1234', minLength: 10, maxLength: 10 },
  { name: 'Tunisia', code: '+216', iso: 'TN', flag: '🇹🇳', placeholder: '20 123 456', minLength: 8, maxLength: 8 },
  { name: 'Turkey', code: '+90', iso: 'TR', flag: '🇹🇷', placeholder: '501 234 56 78', minLength: 10, maxLength: 10 },
  { name: 'Uganda', code: '+256', iso: 'UG', flag: '🇺🇬', placeholder: '772 123456', minLength: 9, maxLength: 9 },
  { name: 'Ukraine', code: '+380', iso: 'UA', flag: '🇺🇦', placeholder: '50 123 4567', minLength: 9, maxLength: 9 },
  { name: 'Uruguay', code: '+598', iso: 'UY', flag: '🇺🇾', placeholder: '94 123 456', minLength: 8, maxLength: 8 },
  { name: 'Uzbekistan', code: '+998', iso: 'UZ', flag: '🇺🇿', placeholder: '90 123 45 67', minLength: 9, maxLength: 9 },
  { name: 'Venezuela', code: '+58', iso: 'VE', flag: '🇻🇪', placeholder: '412-1234567', minLength: 10, maxLength: 10 },
  { name: 'Vietnam', code: '+84', iso: 'VN', flag: '🇻🇳', placeholder: '91 234 56 78', minLength: 9, maxLength: 10 },
  { name: 'Zambia', code: '+260', iso: 'ZM', flag: '🇿🇲', placeholder: '97 1234567', minLength: 9, maxLength: 9 },
  { name: 'Zimbabwe', code: '+263', iso: 'ZW', flag: '🇿🇼', placeholder: '71 234 5678', minLength: 9, maxLength: 9 },
];

/**
 * Normalizes any phone input into strict E.164 format:
 * Begins with '+', country calling code, followed by subscriber digits without whitespace, dashes or brackets.
 */
export function normalizeToE164(phone: string, defaultCallingCode?: string): string {
  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  if (!cleaned.startsWith('+')) {
    if (defaultCallingCode) {
      const prefix = defaultCallingCode.startsWith('+') ? defaultCallingCode : `+${defaultCallingCode}`;
      // Strip leading trunk zero if applicable (common in UK/EU: e.g. 07911 -> +447911)
      cleaned = `${prefix}${cleaned.replace(/^0+/, '')}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
}

/**
 * Validates international E.164 phone numbers.
 * ITU-T E.164 specification:
 * - Starts with '+'
 * - Total digits between 7 and 15 (excluding '+')
 * - If country is provided, validates national digits length within the country's bounds
 */
export function validateInternationalE164(
  fullPhone: string,
  country?: Country
): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeToE164(fullPhone, country?.code);

  // General E.164 regex test
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Invalid international phone format. Numbers must be in standard international format (7–15 digits, e.g. +919876543210, +15550192834).',
    };
  }

  // Country-specific boundary validation
  if (country) {
    const codeDigits = country.code.replace('+', '');
    const numberWithoutPlus = normalized.replace('+', '');
    if (numberWithoutPlus.startsWith(codeDigits)) {
      const nationalPart = numberWithoutPlus.slice(codeDigits.length);
      if (nationalPart.length < country.minLength) {
        return {
          valid: false,
          normalized,
          error: `Incomplete phone number for ${country.name}. Please enter at least ${country.minLength} digits after ${country.code}.`,
        };
      }
      if (nationalPart.length > country.maxLength) {
        return {
          valid: false,
          normalized,
          error: `Phone number for ${country.name} exceeds standard length (maximum ${country.maxLength} digits after ${country.code}).`,
        };
      }
    }
  }

  return { valid: true, normalized };
}
