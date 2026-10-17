import { startReader } from "./reader-app.mjs?v=team-recommendation";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
