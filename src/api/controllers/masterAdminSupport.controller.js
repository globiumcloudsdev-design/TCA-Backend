import { supportService } from '../../services/support.service.js';
import { getUserId } from '../../utils/helpers/request.helper.js';

export const masterAdminSupportController = {
  async getAllTickets(req, res) {
    try {
      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        institute_id: req.query.institute_id
      };
      
      const tickets = await supportService.getAllTickets(filters);
      res.status(200).json({ success: true, data: tickets });
    } catch (error) {
      console.error('[masterAdminSupportController.getAllTickets] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getTicketDetails(req, res) {
    try {
      const ticketId = req.params.id;
      const ticket = await supportService.getTicketDetails(ticketId); // No schoolId filter for master admin
      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      console.error('[masterAdminSupportController.getTicketDetails] Error:', error);
      res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, message: error.message });
    }
  },

  async updateTicketStatus(req, res) {
    try {
      const ticketId = req.params.id;
      const { status } = req.body;
      
      if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

      const ticket = await supportService.updateTicketStatus(ticketId, status);
      res.status(200).json({ success: true, data: ticket, message: 'Ticket status updated successfully' });
    } catch (error) {
      console.error('[masterAdminSupportController.updateTicketStatus] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async addReply(req, res) {
    try {
      const ticketId = req.params.id;
      const { message } = req.body;
      const userId = getUserId(req);
      const userName = `${req.user.first_name} ${req.user.last_name}`.trim() || 'Master Admin';
      
      if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

      const ticket = await supportService.addReply(ticketId, message, userId, userName, 'MASTER_ADMIN');
      res.status(200).json({ success: true, data: ticket, message: 'Reply added successfully' });
    } catch (error) {
      console.error('[masterAdminSupportController.addReply] Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
