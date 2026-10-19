import { startReader } from "./reader-app.mjs?v=draft-deck-management-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
