// to run the queue processing in a separate node thread
import 'dotenv/config';
import Queue from './lib/Queue';

Queue.processQueue();
