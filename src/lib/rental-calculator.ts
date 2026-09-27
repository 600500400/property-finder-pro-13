/** User-entered scenario, NOT the scanner's automatic 15% cost estimate. */
export function calculateRentalScenario(
  price: number,
  rent: number,
  ownerCosts: number,
  vacancyPercent: number,
) {
  if (
    ![price, rent, ownerCosts, vacancyPercent].every(Number.isFinite) ||
    price <= 1 ||
    rent < 0 ||
    ownerCosts < 0 ||
    vacancyPercent < 0 ||
    vacancyPercent > 100
  )
    return null;
  const annualGross = rent * 12;
  const annualNet = annualGross * (1 - vacancyPercent / 100) - ownerCosts * 12;
  const grossYield = (annualGross / price) * 100;
  const netYield = (annualNet / price) * 100;
  if (![annualGross, annualNet, grossYield, netYield].every(Number.isFinite)) return null;
  return { annualGross, annualNet, grossYield, netYield };
}
