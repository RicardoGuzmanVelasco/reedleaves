import { startReader } from "./reader-app.mjs?v=deck-detail-actions-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
