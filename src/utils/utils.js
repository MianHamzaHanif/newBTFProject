export const ParseCustomDateFormate = (dateStr) => {
  // "19/11/2025, 12:48 PM"
  const [datePart, timePart] = dateStr.split(", ");

  const [day, month, year] = datePart.split("/");

  let [time, modifier] = timePart.split(" ");
  let [hours, minutes] = time.split(":");

  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes);
};

export function formatWallet(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
