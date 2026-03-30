function generateNumber(prefix) {
  const date = new Date();
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ];
  const random = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${parts.join("")}-${random}`;
}

module.exports = { generateNumber };
