import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { labTrace } from './lab-trace';

/** Response header carrying the trace: base64(JSON) so any key text stays header-safe. */
export const LAB_TRACE_HEADER = 'X-Lab-Trace';

/**
 * Wraps a handler in a lab trace and attaches the result as a response header,
 * on success and on error (409/500 are the interesting cases).
 * Dev/lab only: does nothing when NODE_ENV=production.
 */
@Injectable()
export class LabTraceInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (process.env.NODE_ENV === 'production') return next.handle();
    const res = ctx.switchToHttp().getResponse<Response>();

    // The handler runs when the observable is subscribed, so the subscription
    // (not just next.handle()) must happen inside the trace context.
    return new Observable((subscriber) =>
      labTrace.run(() => {
        const attach = () => {
          const trace = labTrace.spans();
          if (trace && !res.headersSent) {
            res.setHeader(LAB_TRACE_HEADER, Buffer.from(JSON.stringify(trace)).toString('base64'));
          }
        };
        return next
          .handle()
          .pipe(
            tap(attach),
            catchError((err) => {
              attach();
              return throwError(() => err);
            }),
          )
          .subscribe(subscriber);
      }),
    );
  }
}
