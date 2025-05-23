import { Body, Controller, Post } from '@nestjs/common';
import { Public } from 'src/decorators/public.decorator';
import { BlueskyService } from './bluesky.service';

/**
 * Controller class for handling Bluesky related operations.
 */
@Controller()
export class BlueskyController {
  /**
   * Constructs a new instance of the BlueskyController.
   */
  constructor(private readonly blueskyService: BlueskyService) {}

  /**
   * Handles the delivery of input data from the workflow.
   *
   * @param param0 - An object containing the `input` property from the request body.
   * @returns The result of the `receive` method from the workflow.
   */
  @Post()
  @Public()
  deliver(@Body() { input }) {
    void this.blueskyService.receive(input);
  }
}
