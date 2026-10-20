import { startReader } from "./reader-app.mjs?v=share-deck-link-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
