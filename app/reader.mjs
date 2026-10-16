import { startReader } from "./reader-app.mjs?v=deck-language-flags";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
