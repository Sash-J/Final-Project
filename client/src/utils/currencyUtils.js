/**
 * Global utility for currency formatting across the application.
 * Centralizing this ensures consistency and allows for easy global changes
 */

export const CURRENCY_SYMBOL = "Rs";
export const CURRENCY_LOCALE = "en-LK";

/**
 * Formats a numeric value into a currency string.
 * @param {number|string} value - The amount to format.
 * @param {boolean} includeSymbol - Whether to prefix the result with the currency symbol.
 * @param {number} minimumFractionDigits - The minimum number of decimal places.
 * @returns {string} - The formatted currency string.
 */
export const formatCurrency = (
  value,
  includeSymbol = true,
  minimumFractionDigits = 2,
) => {
  const num = parseFloat(value) || 0;

  const formatted = new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(num);

  return includeSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted;
};

/**
 * Helper to get the currency symbol for use in labels or placeholders.
 */
export const getCurrencySymbol = () => CURRENCY_SYMBOL;
