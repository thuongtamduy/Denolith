const isProduction = Deno.env.get("DENO_ENV") === "production";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string, ...args: unknown[]) {
    console.log(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.green}[INFO]${COLORS.reset} ${message}`,
      ...args,
    );
  },

  warn(message: string, ...args: unknown[]) {
    console.warn(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.yellow}[WARN]${COLORS.reset} ${message}`,
      ...args,
    );
  },

  error(message: string, ...args: unknown[]) {
    console.error(
      `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.red}[ERROR]${COLORS.reset} ${message}`,
      ...args,
    );
  },

  debug(message: string, ...args: unknown[]) {
    if (!isProduction) {
      console.debug(
        `${COLORS.dim}[${timestamp()}]${COLORS.reset} ${COLORS.cyan}[DEBUG]${COLORS.reset} ${message}`,
        ...args,
      );
    }
  },
};
