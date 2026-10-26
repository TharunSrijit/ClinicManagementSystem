from django.db import migrations


def make_legacy_stock_reorder_level_nullable(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor != 'mysql':
        return

    table_name = 'apibackendapp_stockmaster'
    with connection.cursor() as cursor:
        cursor.execute(
            f'SHOW COLUMNS FROM {schema_editor.quote_name(table_name)}'
        )
        columns = {
            row[0]: (row[1], row[2])
            for row in cursor.fetchall()
        }

    column = columns.get('reorder_level')
    if column is None:
        return

    column_type, is_nullable = column
    if is_nullable == 'YES':
        return

    schema_editor.execute(
        f'ALTER TABLE {schema_editor.quote_name(table_name)} '
        f'MODIFY COLUMN {schema_editor.quote_name("reorder_level")} '
        f'{column_type} NULL'
    )


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ('apibackendapp', '0012_mastermedicine_reorder_level'),
    ]

    operations = [
        migrations.RunPython(make_legacy_stock_reorder_level_nullable),
    ]
