import {
  getBehaviorHistory
} from "./repositories/behaviorHistoryRepository.js";

import {
  discoverPatterns
} from "./src/services/patternDiscoveryService.js";

import {
  characterizePatterns
} from "./src/services/characterizationService.js";

import {
  learnFromCharacter
} from "./src/services/learningEngineService.js";

import {
  createMemory
} from "./repositories/memoryRepository.js";

const identityId =
  process.argv[2];

const history =
  getBehaviorHistory(
    identityId
  );

const patterns =
  discoverPatterns(
    history
  );

const character =
  characterizePatterns(
    patterns
  );

const learning =
  learnFromCharacter(
    character
  );

const memory =
  createMemory({
    identityId,
    memoryType:
      learning.learning,
    confidence:
      learning.confidence
  });

console.log(
  "\nHISTORY:"
);

console.log(
  JSON.stringify(
    history,
    null,
    2
  )
);

console.log(
  "\nPATTERNS:"
);

console.log(
  JSON.stringify(
    patterns,
    null,
    2
  )
);

console.log(
  "\nCHARACTERIZATION:"
);

console.log(
  JSON.stringify(
    character,
    null,
    2
  )
);

console.log(
  "\nLEARNING:"
);

console.log(
  JSON.stringify(
    learning,
    null,
    2
  )
);

console.log(
  "\nMEMORY:"
);

console.log(
  JSON.stringify(
    memory,
    null,
    2
  )
);
