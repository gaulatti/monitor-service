import { Observable } from 'rxjs';
import { TriggerRequest, TriggerResponse } from 'src/types/wiphala';

/**
 * Interface representing the Wiphala service.
 * Provides methods for interacting with application features and user authentication.
 */
export interface WiphalaService {
  trigger(data: TriggerRequest): Observable<TriggerResponse>;
}
