export function getISTDate(): Date {
  const now = new Date();
  
  const offset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + offset);
  return istDate;
}

export function formatISTTime(date: Date): { time: string; date: string; isoDate: string } {
  const isoString = date.toISOString();
  const [datePart, fullTimePart] = isoString.split('T');
  const timePart = fullTimePart.split('.')[0];
  
  return {
    time: timePart,
    date: datePart,
    isoDate: datePart
  };
}
