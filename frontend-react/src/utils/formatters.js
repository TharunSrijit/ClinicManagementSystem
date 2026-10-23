export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatTime(timeString) {
  if (!timeString) return '-';
  if (timeString.includes(':')) {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  }
  return timeString;
}

export function getStatusBadgeVariant(status) {
  const s = String(status || '').toUpperCase();
  if (['ACTIVE', 'COMPLETED', 'PAID', 'CONFIRMED'].includes(s)) return 'success';
  if (['PENDING', 'BOOKED', 'WAITING', 'PARTIAL', 'SAMPLE_COLLECTED'].includes(s)) return 'warning';
  if (['CANCELLED', 'INACTIVE', 'NO_SHOW'].includes(s)) return 'danger';
  if (['PROCESSING', 'IN_CONSULTATION'].includes(s)) return 'primary';
  return 'info';
}
