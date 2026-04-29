-- Fix RLS policies for transactions table

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing possible bad policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;

DROP POLICY IF EXISTS "Teachers select school data" ON public.transactions;
DROP POLICY IF EXISTS "Teachers insert school data" ON public.transactions;
DROP POLICY IF EXISTS "Teachers update school data" ON public.transactions;
DROP POLICY IF EXISTS "Headteachers manage school data" ON public.transactions;
DROP POLICY IF EXISTS "Teachers manage school data" ON public.transactions;


-- 1. Everyone can view their own transactions, and admins can view all
CREATE POLICY "Transactions: Viewable" ON public.transactions
    FOR SELECT USING (
        user_id = auth.uid() OR 
        public.is_admin()
    );

-- 2. Users can insert their own transactions
CREATE POLICY "Transactions: Insertable" ON public.transactions
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        public.is_admin()
    );

-- 3. Users can update their own transactions 
CREATE POLICY "Transactions: Updatable" ON public.transactions
    FOR UPDATE USING (
        user_id = auth.uid() OR
        public.is_admin()
    )
    WITH CHECK (
        user_id = auth.uid() OR
        public.is_admin()
    );

-- 4. Admins can delete
CREATE POLICY "Transactions: Deletable" ON public.transactions
    FOR DELETE USING (
        public.is_admin()
    );

GRANT ALL ON TABLE public.transactions TO authenticated, service_role;
