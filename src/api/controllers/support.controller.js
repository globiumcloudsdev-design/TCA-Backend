import { supportService } from '../../services/support.service.js';
import { getInstituteId, getUserId } from '../../utils/helpers/request.helper.js';

export const supportController = {
  async createTicket(req, res) {
    try {
      const instituteId = getInstituteId(req);
      const userId = getUserId(req);
      
      const ticket = await supportService.createTicket(req.body, instituteId, userId);
      res.status(201).json({ success: true, data: ticket, message: 'Ticket created successfully' });
    } catch (error) {
      console.error('[supportController.createTicket] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getMyTickets(req, res) {
    try {
      const instituteId = getInstituteId(req);
      const tickets = await supportService.getInstituteTickets(instituteId);
      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      console.error('[supportController.getMyTickets] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getTicketDetails(req, res) {
    try {
      const instituteId = getInstituteId(req);
      const ticketId = req.params.id;
      
      const ticket = await supportService.getTicketDetails(ticketId, instituteId);
      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      console.error('[supportController.getTicketDetails] Error:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, message: error.message });
    }
  },

  async addReply(req, res) {
    try {
      const instituteId = getInstituteId(req);
      const ticketId = req.params.id;
      const { message } = req.body;
      const userId = getUserId(req);
      const userName = `${req.user.first_name} ${req.user.last_name}`.trim();
      
      if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

      const ticket = await supportService.addReply(ticketId, message, userId, userName, 'INSTITUTE', instituteId);
      res.status(200).json({ success: true, data: ticket, message: 'Reply added successfully' });
    } catch (error) {
      console.error('[supportController.addReply] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
