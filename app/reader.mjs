import { startReader } from "./reader-app.mjs?v=public-deck-reading-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
