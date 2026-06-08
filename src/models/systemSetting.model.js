const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: [true, 'Setting key is required'],
            unique: true,
            trim: true,
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
            required: [true, 'Setting value is required'],
        },
    },
    {
        timestamps: true,
    }
);

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

module.exports = SystemSetting;
