export const CURRENCY_SYMBOL = "Rs";
export const CURRENCY_LOCALE = "en-LK";

/**
 * Formats currency
 * Help from OpenAI
 @param {number|string} value
@param {boolean} includeSymbol
@param {number} minimumFractionDigits
@returns {string} 
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

export const getCurrencySymbol = () => CURRENCY_SYMBOL;
