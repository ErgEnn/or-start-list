import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { t } from '../i18n';

export function MainList() {

  const people = [
    {
      eol_code: '123456',
      first_name: 'John',
      last_name: 'Doe',
      si_code: '7890',
      class: 'M21',
      price: '10€'
    }
  ,
    {
      eol_code: '123457',
      first_name: 'Jane',
      last_name: 'Smith',
      si_code: '7891',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123458',
      first_name: 'Bob',
      last_name: 'Johnson',
      si_code: '7892',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123459',
      first_name: 'Alice',
      last_name: 'Williams',
      si_code: '7893',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123460',
      first_name: 'Charlie',
      last_name: 'Brown',
      si_code: '7894',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123461',
      first_name: 'Diana',
      last_name: 'Davis',
      si_code: '7895',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123462',
      first_name: 'Edward',
      last_name: 'Miller',
      si_code: '7896',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123463',
      first_name: 'Fiona',
      last_name: 'Wilson',
      si_code: '7897',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123464',
      first_name: 'George',
      last_name: 'Moore',
      si_code: '7898',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123465',
      first_name: 'Hannah',
      last_name: 'Taylor',
      si_code: '7899',
      class: 'M21',
      price: '10€'
    },
    {
      eol_code: '123466',
      first_name: 'Isaac',
      last_name: 'Anderson',
      si_code: '7900',
      class: 'M21',
      price: '10€'
    }
  ]
  //const list = [...people, ...people, ...people, ...people, ...people, ...people, ...people, ...people, ...people, ...people]
  const list = [...people]

  return (
    <TableContainer
      component={Paper}
      sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}
    >
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{t('eol_code')}</TableCell>
            <TableCell>{t('first_name')}</TableCell>
            <TableCell>{t('last_name')}</TableCell>
            <TableCell>{t('si_code')}</TableCell>
            <TableCell>{t('class')}</TableCell>
            <TableCell>{t('price')}</TableCell>
            <TableCell>{t('course')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((item, index) => (
            <TableRow key={index}>
              <TableCell align='right' width={10}>{item.eol_code}</TableCell>
              <TableCell>{item.first_name}</TableCell>
              <TableCell>{item.last_name}</TableCell>
              <TableCell>{item.si_code}</TableCell>
              <TableCell>{item.class}</TableCell>
              <TableCell>{item.price}</TableCell>
              <TableCell><CourseSelector /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CourseSelector() {
  const courses = ['1', '2', '3', '4', 'VV']
  return (
    <ToggleButtonGroup exclusive sx={{width: '100%'}}>
      {courses.map(course => (
        <ToggleButton key={course} value={course}>
          {course}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}

