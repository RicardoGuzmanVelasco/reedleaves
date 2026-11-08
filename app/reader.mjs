import { startReader } from "./reader-app.mjs?v=card-source-deck-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
