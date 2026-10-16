/**
 * Reads every row of a query whose responses are capped (Supabase returns at
 * most 1000 rows unless told otherwise), one page at a time. `page(from, to)`
 * runs the query for that inclusive row range, under a stable order. Stops at
 * the first error and returns it with the rows read so far.
 */
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 1000): Promise<{ data: T[]; error: unknown }> {
    const rows: T[] = [];
    for (let from = 0; ; from += size) {
        const { data, error } = await page(from, from + size - 1);
        if (error)
            return { data: rows, error };
        rows.push(...(data ?? []));
        if (!data || data.length < size)
            return { data: rows, error: null };
    }
}
