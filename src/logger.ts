import util from 'node:util'
import chalk from 'chalk'

/**
 * Enumeration of log severity levels.
 * Messages will only be printed if their level is at or above the current logger level.
 */
export enum LogLevel {
  /** Detailed debugging information */
  DEBUG = 10,
  /** Informational messages */
  INFO = 20,
  /** Warning conditions */
  WARN = 30,
  /** Error conditions */
  ERROR = 40,
  /** No messages will be printed */
  NONE = 50,
}

/**
 * Options for configuring a Logger instance.
 */
export interface LoggerOptions {
  /**
   * Minimum severity level for messages to be printed.
   * @default LogLevel.INFO
   */
  level?: LogLevel

  /**
   * Namespace identifier to include in each message.
   * Will be formatted as `[namespace]`.
   */
  namespace?: string

  /**
   * Whether to use ANSI colors when printing.
   * @default true if stdout is a TTY.
   */
  color?: boolean
}

/**
 * A simple, configurable logger for Node.js applications.
 * Prints timestamped messages at or above the configured severity level,
 * with optional namespace tagging and colored output.
 */
export class Logger {
  /** The active minimum severity level */
  private currentLevel: LogLevel

  /** The formatted namespace prefix (e.g. “[MyApp]”), or empty string */
  private readonly namespacePrefix: string

  /** Flag indicating whether colored output is enabled */
  private readonly enableColor: boolean

  /**
   * Constructs a new Logger.
   * @param options Configuration options (level, namespace, color).
   */
  constructor(options: LoggerOptions = {}) {
    this.currentLevel = options.level ?? LogLevel.INFO
    this.namespacePrefix = options.namespace ? `[${options.namespace}]` : ''
    this.enableColor = options.color ?? process.stdout.isTTY
  }

  /**
   * Sets a new minimum log level.
   * Messages below this level will be ignored.
   * @param newLevel The new LogLevel to apply.
   */
  public setLevel(newLevel: LogLevel): void {
    this.currentLevel = newLevel
  }

  /**
   * Logs a message at DEBUG level.
   * @param message The message text to log.
   * @param metadata Optional additional data to include in the output.
   */
  public debug(message: string, metadata?: unknown): void {
    this.printLog(LogLevel.DEBUG, 'DEBUG', message, metadata)
  }

  /**
   * Logs a message at INFO level.
   * @param message The message text to log.
   * @param metadata Optional additional data to include in the output.
   */
  public info(message: string, metadata?: unknown): void {
    this.printLog(LogLevel.INFO, 'INFO ', message, metadata)
  }

  /**
   * Logs a message at WARN level.
   * @param message The message text to log.
   * @param metadata Optional additional data to include in the output.
   */
  public warn(message: string, metadata?: unknown): void {
    this.printLog(LogLevel.WARN, 'WARN ', message, metadata)
  }

  /**
   * Logs a message at ERROR level.
   * @param message The message text to log.
   * @param metadata Optional additional data to include in the output.
   */
  public error(message: string, metadata?: unknown): void {
    this.printLog(LogLevel.ERROR, 'ERROR', message, metadata)
  }

  /**
   * Internal helper to format and print a log line if its level passes the filter.
   * @param severityLevel The severity of this message.
   * @param logLabel A fixed-width textual label (e.g. “DEBUG”).
   * @param message The main message content.
   * @param metadata Optional additional data to be inspected and appended.
   */
  private printLog(
    severityLevel: LogLevel,
    logLabel: string,
    message: string,
    metadata?: unknown,
  ): void {
    // Skip messages below the current level threshold
    if (severityLevel < this.currentLevel) {
      return
    }

    // ISO timestamp for consistency
    const timestamp = new Date().toISOString()

    // Base line: timestamp, label, optional namespace, then message
    let outputLine = `${timestamp} [${logLabel}]${this.namespacePrefix} ${message}`

    // If additional data was provided, inspect it deeply
    if (metadata !== undefined) {
      const inspected = util.inspect(metadata, {
        depth: null,
        colors: this.enableColor,
        compact: false,
      })
      outputLine += ` ${inspected}`
    }

    // Print with or without ANSI coloring
    console.log(this.colorize(severityLevel, outputLine))
  }

  /**
   * Applies ANSI color codes to a log line based on its severity.
   * If coloring is disabled, returns the text unmodified.
   * @param severityLevel The severity level determining the color.
   * @param text The full log line to colorize.
   * @returns The potentially colorized string.
   */
  private colorize(severityLevel: LogLevel, text: string) {
    if (!this.enableColor)
      return text
    switch (severityLevel) {
      case LogLevel.DEBUG: return chalk.cyanBright(text)
      case LogLevel.INFO: return chalk.blue(text)
      case LogLevel.WARN: return chalk.yellow(text)
      case LogLevel.ERROR: return chalk.red(text)
      default: return text
    }
  }
}

export const logger = new Logger()
