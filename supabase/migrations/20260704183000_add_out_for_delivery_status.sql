-- Add "With Rider" fulfilment stage: the package has left the store and is
-- with a delivery rider. Sits between 'shipped' (packaged) and 'delivered'.
alter type public.order_status add value if not exists 'out_for_delivery' after 'shipped';
