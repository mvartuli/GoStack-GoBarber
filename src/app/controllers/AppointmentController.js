import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';
import Notification from '../schemas/Notification';
import Queue from '../../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';

class AppointmentController {
    async index(req, res) {
        const { page = 1 } = req.query;
        const appointments = await Appointment.findAll({
            where: { user_id: req.userId, canceled_at: null },
            order: ['date'],
            limit: 20,
            offset: (page - 1) * 20,
            attributes: ['id', 'date', 'past', 'cancelable', 'user_id', 'provider_id'],
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name', 'email'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'name', 'path', 'url'],
                        },
                    ],
                },
            ],
        });
        return res.json(appointments);
    }

    async store(req, res) {
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            date: Yup.date().required(),
        });
        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ error: 'Validation fails' });
        }

        const { provider_id, date } = req.body;

        // Check if provider_id is a provider
        const isProvider = await User.findOne({
            where: { id: provider_id, provider: true },
        });
        if (!isProvider) {
            return res
                .status(401)
                .json({ error: 'You can only create appointments with providers' });
        }

        // parseISO - returns date object
        // startOfHour - returns the full hour start
        // Check for past dates
        const hourStart = startOfHour(parseISO(date));
        if (isBefore(hourStart, new Date())) {
            return res.status(400).json({ error: 'Past dates are not permitted' });
        }

        // check date availability
        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourStart,
            },
        });
        if (checkAvailability) {
            return res.status(400).json({ error: 'Date is not available' });
        }

        // Chek if loged user is trying to appoint to himself
        if (req.userId === provider_id) {
            return res.status(401).json({ error: 'You cannot create appointments to yourself' });
        }

        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            date,
        });

        const { name } = await User.findByPk(req.userId);
        const formatedDate = format(hourStart, "'dia' dd 'de' MMM', às' H:mm'h'", { locale: pt });

        // Notify appointment provider
        await Notification.create({
            content: `Novo agendamento de ${name} para o ${formatedDate}`,
            user: provider_id,
        });

        return res.json(appointment);
    }

    async delete(req, res) {
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'email'],
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name'],
                },
            ],
        });
        if (!appointment) {
            return res.status(400).json({ error: 'Appointment not found' });
        }
        if (appointment.user_id !== req.userId) {
            return res.status(401).json({ error: 'You cannot cancel this appointment' });
        }

        const dateWithSub = subHours(appointment.date, 2);
        if (isBefore(dateWithSub, new Date())) {
            return res
                .status(401)
                .json({ error: 'You can only cancel appointments at least 2 hours in advance' });
        }
        appointment.canceled_at = new Date();

        await appointment.save();

        await Queue.add(CancellationMail.key, {
            appointment,
        });

        return res.json(appointment);
    }
}

export default new AppointmentController();
