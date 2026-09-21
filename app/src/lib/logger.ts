type Fields = Record<string, unknown>;

function write(level: string, message: string, fields: Fields): void {
  console.log(JSON.stringify({ level, message, ...fields }));
}

export const log = {
  info: (message: string, fields: Fields = {}) => write('info', message, fields),
  warn: (message: string, fields: Fields = {}) => write('warn', message, fields),
  error: (message: string, fields: Fields = {}) => write('error', message, fields),
};
