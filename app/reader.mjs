import { startReader } from "./reader-app.mjs?v=book-metadata-cleanup";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
