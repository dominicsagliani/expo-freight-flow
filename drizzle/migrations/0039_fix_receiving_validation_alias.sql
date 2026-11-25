DO $$ DECLARE definition text; BEGIN
SELECT pg_get_functiondef('public.receive_bill_of_lading(uuid,uuid,text,text,text,bigint,text,text,text,text,text,integer,text,numeric,text,jsonb,uuid)'::regprocedure) INTO definition;
definition := replace(definition, 'FROM jsonb_array_elements(_crates) c(value) WHERE jsonb_typeof(c.value)<>''object'' OR coalesce(nullif(c.value->>''weight_lbs'','''')::numeric,0)<0 OR coalesce(c.value->>''weight_lbs'','''') IN (''NaN'',''Infinity'',''-Infinity'')', 'FROM jsonb_array_elements(_crates) weight_check(value) WHERE jsonb_typeof(weight_check.value)<>''object'' OR coalesce(nullif(weight_check.value->>''weight_lbs'','''')::numeric,0)<0 OR coalesce(weight_check.value->>''weight_lbs'','''') IN (''NaN'',''Infinity'',''-Infinity'')');
EXECUTE definition;
END $$;