
-- Function to update credit balance automatically when a transaction is successful
CREATE OR REPLACE FUNCTION public.handle_transaction_success()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if status changed to success
    IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
        RAISE NOTICE 'Updating credit balance for user % by %', NEW.user_id, NEW.amount;
        
        UPDATE public.profiles
        SET credit_balance = COALESCE(credit_balance, 0) + NEW.amount
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger
DROP TRIGGER IF EXISTS on_transaction_success ON public.transactions;
CREATE TRIGGER on_transaction_success
    AFTER INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_transaction_success();

-- Ensure credit_balance column exists on profiles (it should, but just in case)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(12,2) DEFAULT 0.00;

-- Grant permissions if needed
GRANT ALL ON TABLE public.transactions TO authenticated, service_role;
