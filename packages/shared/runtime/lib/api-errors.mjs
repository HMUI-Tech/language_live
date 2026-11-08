export function clientError(message, status = 400) {
  return Object.assign(new Error(message), { publicSafe: true, status });
}
export function safeFailure(error) {
  if (
    error?.publicSafe === true &&
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status < 500
  )
    return { message: error.message, status: error.status };
  return {
    message: "Service temporarily unavailable. Please try again.",
    status: 503,
  };
}
