import fs from 'fs';

import path from 'path';

// Path to config.json
const configPath = 'config.json';

// Load config at startup
let config = {};

if (fs.existsSync(configPath)) {

    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

} else {

    config = { users: {} };
}

// Auto-save config when modified
const saveConfig = () => {

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
};

// **Direct Access Object**
export default {

    config,

    save() {

        saveConfig();
    }
};
