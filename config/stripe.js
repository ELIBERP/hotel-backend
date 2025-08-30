// config/stripe.js
import dotenv from 'dotenv';

// COMMENTED OUT (API CALL)
/*
import Stripe from 'stripe';

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables. Please add your Stripe secret key to .env file');
  console.warn('⚠️  Stripe payments will not work until this is configured');
}

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
*/

dotenv.config();

// Mock Stripe implementation using static data
const stripe = {
  checkout: {
    sessions: {
      create: async (options) => {
        console.log('MOCK STRIPE: Creating checkout session with options:', options);
        return {
          id: 'mock_session_' + Date.now(),
          url: 'https://mock-checkout.stripe.com/pay/' + Date.now(),
          payment_status: 'unpaid',
          amount_total: options.line_items[0]?.amount || 10000,
          currency: options.currency || 'sgd'
        };
      },
      retrieve: async (sessionId) => {
        console.log('MOCK STRIPE: Retrieving session with ID:', sessionId);
        return {
          id: sessionId,
          payment_status: 'paid',
          customer_details: {
            email: 'mock_customer@example.com',
            name: 'Mock Customer'
          },
          amount_total: 10000,
          currency: 'sgd',
          payment_intent: {
            id: 'mock_pi_' + Date.now(),
            client_secret: 'mock_secret_' + Date.now()
          }
        };
      }
    }
  },
  webhooks: {
    constructEvent: (body, signature, secret) => {
      console.log('MOCK STRIPE: Constructing webhook event');
      return {
        id: 'mock_event_' + Date.now(),
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'mock_session_' + Date.now(),
            payment_status: 'paid',
            customer_details: {
              email: 'mock_customer@example.com',
              name: 'Mock Customer'
            },
            metadata: {
              booking_id: 'mock_booking_' + Date.now()
            }
          }
        }
      };
    }
  }
};

console.log('Using MOCK Stripe implementation with static data');
export default stripe;
