import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

/**
 * The data required to trigger a playlist.
 */
export interface DeliverRequest {
  payload: string;
}

/**
 * The response of a triggered playlist.
 */
export interface DeliverResponse {
  success: boolean;
}

/**
 * Controller class for handling Bluesky related operations.
 */
@Controller()
export class BlueskyController {
  /**
   * Constructs a new instance of the BlueskyController.
   */
  constructor() {}

  /**
   * Handles the gRPC method 'Deliver' for the 'ClientService'.
   *
   * @param data - The request data for the deliver operation.
   * @returns A promise that resolves to a DeliverResponse indicating the success of the operation.
   */
  @GrpcMethod('ClientService', 'Deliver')
  async deliver(data: DeliverRequest): Promise<DeliverResponse> {
    // TODO: Process data
    return Promise.resolve({ success: true });
  }
}
