import { retryWorker } from "./services/retryWorker.mjs";
import { logger } from "./logger.mjs";
import { statusCodes } from "./utils/constant.mjs";
import dotenv from "dotenv";

dotenv.config();

export const handler = async (event, context) => {
  logger.setLambdaContext(context);
  const requestId = context?.awsRequestId || "local";

  logger.info({
    service: "retry-worker",
    step: "LAMBDA_START",
    requestId,
    sqsRecordCount: event.Records?.length || 0,
  });

  try {
    for (const record of event.Records) {
      const body = JSON.parse(record.body);

      // Check if it's a nested batch (100 records) or a single legacy message
      const recordsToProcess = body.records || [body];
      const batchId = body.batchId || "N/A";

      logger.info({
        service: "retry-worker",
        step: "START_PROCESSING_SQS_MESSAGE",
        messageId: record.messageId,
        batchId: batchId,
        nestedRecordCount: recordsToProcess.length,
      });

      // Nested records par loop chalayenge
      for (const msg of recordsToProcess) {
        try {
          // Har individual recovery record ko process karenge
          logger.debug({
            service: "retry-worker",
            step: "PROCESSING_RECOVERY_MESSAGE",
            recoveryId: msg.recoveryId,
            msg,
          });
          await retryWorker.process(msg);

          logger.info({
            service: "retry-worker",
            step: "RECORD_PROCESSED_SUCCESS",
            recoveryId: msg.recoveryId,
            requestId,
          });
        } catch (recordErr) {
          // Ek record fail ho toh pura batch fail nahi karna chahiye
          // Hum sirf log karenge aur aage badhenge
          logger.error({
            service: "retry-worker",
            step: "INDIVIDUAL_RECORD_ERROR",
            recoveryId: msg.recoveryId,
            error: recordErr.message,
            requestId,
          });

          // Note: Agar aap chahte ho ki SQS message retry ho,
          // toh yahan throw err karna padega, lekin wo poore 100 records ko retry karega.
        }
      }

      logger.info({
        service: "retry-worker",
        step: "SQS_MESSAGE_DONE",
        messageId: record.messageId,
      });
    }

    logger.info({
      service: "retry-worker",
      step: "LAMBDA_SUCCESS",
      requestId,
    });

    return {
      statusCode: statusCodes.OK,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    logger.error({
      service: "retry-worker",
      step: "LAMBDA_FATAL_ERROR",
      requestId,
      error: error.message,
      stack: error.stack,
    });

    // Throwing here will make the WHOLE SQS batch visible again
    throw error;
  }
};
