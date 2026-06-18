import {
  getBehaviorHistory
} from "../../repositories/behaviorHistoryRepository.js";

import {
  discoverPatterns
} from "./patternDiscoveryService.js";

import {
  characterizePatterns
} from "./characterizationService.js";

export function buildPopulationArchive(
  identityIds
) {

  return identityIds.map(
    identityId => {

      const history =
        getBehaviorHistory(
          identityId
        );

      const patterns =
        discoverPatterns(
          history
        );

      const characterization =
        characterizePatterns(
          patterns
        );

      return {
        identityId,
        history,
        patterns,
        characterization
      };

    }
  );

}
