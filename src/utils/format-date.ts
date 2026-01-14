export default function formatDate(value: any): string {
  if (!value) return '';

  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);

  const timeZone = 'America/Argentina/Buenos_Aires';

  const date = new Intl.DateTimeFormat('es-AR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);

  const time = new Intl.DateTimeFormat('es-AR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d).toLowerCase();

  // ⬇️ IMPORTANTE: salto de línea
  return `${date}\n${time}`;
}

