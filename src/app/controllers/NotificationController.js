import Notification from '../schemas/Notification';
import User from '../models/User';

class NotificationController {
    async index(req, res) {
        const checkUserProvider = await User.findOne({
            where: { id: req.userId, provider: true },
        });
        if (!checkUserProvider) {
            return res.status(401).json({ error: 'Only providers can load notifications' });
        }

        const notifications = await Notification.find({
            user: req.userId,
        })
            .sort({ createdAt: 'desc' })
            .limit(20);

        return res.json(notifications);
    }

    async update(req, res) {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            { read: true }, // the update
            { new: true } // to return the register after the update
        );
        return res.json(notification);
    }
}

export default new NotificationController();
