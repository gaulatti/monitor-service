import { Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import { PostIngestionService } from './post-ingestion.service';

/**
 * Controller class for handling post ingestion operations.
 */
@Controller()
export class PostIngestionController {
  /**
   * Constructs a new instance of the PostIngestionController.
   */
  constructor(private readonly postIngestionService: PostIngestionService) {}

  /**
   * Handles the delivery of input data from the workflow.
   *
   * @param param0 - An object containing the `input` property from the request body.
   * @returns The result of the `receive` method from the workflow.
   */
  @Post()
  @Public()
  deliver(@Body() { input }) {
    void this.postIngestionService.receive(input);
  }
}