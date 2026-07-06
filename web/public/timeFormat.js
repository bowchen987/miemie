function padTime(value) {
  return String(value).padStart(2, "0");
}

function toValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameLocalDay(left, right) {
  return startOfLocalDay(left).getTime() === startOfLocalDay(right).getTime();
}

export function formatTime(value, now = new Date()) {
  const date = toValidDate(value);
  const current = toValidDate(now);
  if (!date || !current) {
    return "";
  }

  const time = `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
  if (isSameLocalDay(date, current)) {
    return time;
  }

  const dayDiff = Math.round((startOfLocalDay(current) - startOfLocalDay(date)) / 86400000);
  if (dayDiff === 1) {
    return `昨天 ${time}`;
  }

  const dateLabel =
    date.getFullYear() === current.getFullYear()
      ? `${date.getMonth() + 1}月${date.getDate()}日`
      : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  return `${dateLabel} ${time}`;
}

export function formatRelativeTime(value, now = new Date()) {
  const date = toValidDate(value);
  const current = toValidDate(now);
  if (!date || !current) {
    return "";
  }

  const seconds = Math.max(0, Math.round((current.getTime() - date.getTime()) / 1000));
  if (seconds < 60) {
    return "刚刚";
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }

  return formatTime(date, current);
}
