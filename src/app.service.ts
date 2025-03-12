import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor() {}

  kickoff() {
    return {
      features: [],
      enums: [],
      me: {
        memberships: [],
      },
    };
  }
}
