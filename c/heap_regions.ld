
MEMORY
{
    /* Define memory regions - developers customize these based on hardware */
    REGION_0 (rwx) : ORIGIN = 0x20000000, LENGTH = 10K
    REGION_1 (rwx) : ORIGIN = 0x20010000, LENGTH = 13K
    REGION_2 (rwx) : ORIGIN = 0x20020000, LENGTH = 9K
}

SECTIONS
{
    /* Export generic region symbols */
    /* Heap implementation assigns names and flags programmatically */
    __heap_region_0_start = ORIGIN(REGION_0);
    __heap_region_0_size = LENGTH(REGION_0);
    
    __heap_region_1_start = ORIGIN(REGION_1);
    __heap_region_1_size = LENGTH(REGION_1);
    
    __heap_region_2_start = ORIGIN(REGION_2);
    __heap_region_2_size = LENGTH(REGION_2);
    
    /* Number of regions defined */
    __heap_region_count = 3;
}