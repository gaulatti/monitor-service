import { Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import { IngestService } from './ingest.service';

/**
 * Controller class for handling ingest operations.
 */
@Controller()
export class IngestController {
  /**
   * Constructs a new instance of the IngestController.
   */
  constructor(private readonly ingestService: IngestService) {}

  /**
   * Handles the delivery of input data from the workflow.
   *
   * @param param0 - An object containing the `input` property from the request body.
   * @returns The result of the `receive` method from the workflow.
   */
  @Post()
  @Public()
  deliver(@Body() { input }) {
    void this.ingestService.receive(input);
  }
}
