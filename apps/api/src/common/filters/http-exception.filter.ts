import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Response } from "express";

export interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const error = this.extractMessage(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(error, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ErrorResponse = { success: false, error, statusCode };
    response.status(statusCode).json(body);
  }

  private extractMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "string") return response;
      if (typeof response === "object" && response !== null && "message" in response) {
        const message = (response as { message: unknown }).message;
        return Array.isArray(message) ? message.join(", ") : String(message);
      }
      return exception.message;
    }
    if (exception instanceof Error) return exception.message;
    return "Internal server error";
  }
}
